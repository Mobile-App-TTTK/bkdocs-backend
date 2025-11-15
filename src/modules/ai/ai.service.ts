import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { Document } from '../documents/entities/document.entity';
import { User } from '../users/entities/user.entity';
import { S3Service } from '../s3/s3.service';
import { DocumentsService } from '../documents/documents.service';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatHistoryItemDto } from './dto/chat-request.dto';
import { UserRole } from '@common/enums/user-role.enum';

enum ChatIntent {
  SEARCH = 'search',
  RECOMMEND = 'recommend',
  SUMMARIZE = 'summarize',
  DOCUMENT_QUESTION = 'document_question',
  GENERAL = 'general',
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: any;
  private readonly MAX_TEXT_LENGTH = 15000;

  // Stopwords tiếng Việt - các từ không cần thiết cho tìm kiếm
  private readonly VIETNAMESE_STOPWORDS = new Set([
    'tìm',
    'tìm kiếm',
    'search',
    'có',
    'tài liệu',
    'về',
    'của',
    'cho',
    'tôi',
    'mình',
    'được',
    'không',
    'là',
    'và',
    'hoặc',
    'với',
    'từ',
    'đến',
    'trong',
    'ngoài',
    'trên',
    'dưới',
    'giúp',
    'hãy',
    'vui lòng',
    'xin',
    'ạ',
    'nhé',
    'nha',
    'document',
    'file',
    'bài',
    'môn',
    'học',
  ]);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DocumentsService))
    private readonly documentsService: DocumentsService
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_API_MODEL') || 'gemini-1.5-pro';

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env file');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: modelName });

    this.logger.log(`Gemini AI initialized with model: ${modelName}`);
  }

  /**
   * Main chat handler
   */
  async chat(
    message: string,
    userId: string,
    history?: ChatHistoryItemDto[]
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Processing chat from user ${userId}: ${message.substring(0, 50)}...`);

    try {
      // Detect intent
      const intent = this.detectIntent(message);
      const documentId = this.extractDocumentId(message);

      // Build context
      const context = await this.buildContext(intent, userId, documentId, message);

      // Generate AI response
      const systemPrompt = this.getSystemPrompt();
      const fullPrompt = context
        ? `${systemPrompt}\n\n **Context:**\n${context}\n\n **User Question:** ${message}`
        : `${systemPrompt}\n\n **User Question:** ${message}`;

      let reply: string;
      try {
        reply = await this.generateCompletionWithHistory(history, message, context, systemPrompt);
      } catch (e) {
        // Fallback: try single-prompt generation
        try {
          reply = await this.generateCompletion(fullPrompt);
        } catch (e2) {
          // If search intent and we have context (document list), return it directly
          if (intent === ChatIntent.SEARCH && context) {
            reply = context;
          } else {
            throw e2;
          }
        }
      }

      const response: ChatResponseDto = {
        reply,
        timestamp: new Date().toISOString(),
        intent,
        suggestedActions: this.getSuggestedActions(intent),
      };

      this.logger.log(`Chat completed in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      this.logger.error('Chat error:', error);
      return {
        reply: this.getErrorMessage(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Detect intent from message
   */
  private detectIntent(message: string): ChatIntent {
    const lower = message.toLowerCase();

    if (lower.match(/tóm\s+tắt|tổng\s+hợp|summary/i)) {
      return ChatIntent.SUMMARIZE;
    }
    if (lower.match(/tìm|search|có\s+tài\s+liệu/i)) {
      return ChatIntent.SEARCH;
    }
    if (lower.match(/gợi\s+ý|đề\s+xuất|recommend/i)) {
      return ChatIntent.RECOMMEND;
    }
    if (lower.match(/giải\s+thích|là\s+gì|như\s+thế\s+nào|tại\s+sao/i)) {
      return ChatIntent.DOCUMENT_QUESTION;
    }

    return ChatIntent.GENERAL;
  }

  /**
   * Extract document ID from message
   */
  private extractDocumentId(message: string): string | null {
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = message.match(uuidPattern);
    return match ? match[0] : null;
  }

  /**
   * Build context based on intent
   */
  private async buildContext(
    intent: ChatIntent,
    userId: string,
    documentId: string | null,
    message: string
  ): Promise<string> {
    try {
      switch (intent) {
        case ChatIntent.SEARCH:
          return await this.buildSearchContext(message);

        case ChatIntent.RECOMMEND:
          return await this.buildRecommendContext(userId);

        case ChatIntent.DOCUMENT_QUESTION:
        case ChatIntent.SUMMARIZE:
          if (!documentId) {
            return 'Vui lòng cung cấp ID tài liệu (ví dụ: "Tóm tắt tài liệu abc-123-xyz")';
          }
          return await this.buildDocumentContext(documentId);

        default:
          return '';
      }
    } catch (error) {
      this.logger.error(`Error building context:`, error);
      return 'Đã xảy ra lỗi khi xử lý yêu cầu.';
    }
  }

  /**
   * Extract search keywords from message
   * Loại bỏ stopwords và chỉ giữ lại keywords quan trọng
   */
  private extractSearchKeywords(message: string): string[] {
    const normalized = this.normalizeNoAccent(message);
    const words = normalized.split(' ');

    // Lọc bỏ stopwords và các từ quá ngắn
    const keywords = words.filter((word) => {
      return word.length >= 2 && !this.VIETNAMESE_STOPWORDS.has(word);
    });

    // Log để debug
    this.logger.log(`Extracted keywords from "${message}": ${keywords.join(', ')}`);

    return keywords;
  }

  /**
   * Normalize text: lowercase + remove Vietnamese diacritics + clean punctuation
   */
  private normalizeNoAccent(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Build search context with smart keyword extraction
   */
  private async buildSearchContext(query: string): Promise<string> {
    // Extract keywords from message
    const keywords = this.extractSearchKeywords(query);

    if (keywords.length === 0) {
      return 'Vui lòng cung cấp từ khóa tìm kiếm cụ thể hơn.';
    }

    // Use DocumentsService to search active documents
    const documents = await this.documentsService.searchActiveDocumentsByKeywords(keywords, 10);

    if (documents.length === 0) {
      return `Không tìm thấy tài liệu nào với từ khóa: "${keywords.join('", "')}"`;
    }

    return this.formatDocumentList(
      `Kết quả tìm kiếm với từ khóa: "${keywords.join('", "')}"`,
      documents
    );
  }

  /**
   * Build recommend context
   */
  private async buildRecommendContext(userId: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['subscribedSubjects', 'subscribedFaculties'],
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng');
    }

    const subjectIds = user.subscribedSubjects.map((s) => s.id);
    const facultyIds = user.subscribedFaculties.map((f) => f.id);

    if (subjectIds.length === 0 && facultyIds.length === 0) {
      return 'Bạn chưa theo dõi môn học hoặc khoa nào. Hãy theo dõi để nhận gợi ý phù hợp!';
    }

    const documents = await this.documentsService.getRecommendedActiveDocuments(
      subjectIds,
      facultyIds,
      10
    );

    if (documents.length === 0) {
      return 'Chưa có tài liệu nào phù hợp.';
    }

    return this.formatDocumentList('Gợi ý dành cho bạn', documents);
  }

  /**
   * Build document context
   */
  private async buildDocumentContext(documentId: string): Promise<string> {
    const doc = await this.documentsService.getDocumentByIdWithRelations(documentId);

    if (!doc) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    let content = '';
    if (this.isProcessableFile(doc.fileKey)) {
      try {
        content = await this.extractTextFromFile(doc.fileKey);
      } catch (error) {
        this.logger.error(`Failed to extract content:`, error);
        content = '[Không thể đọc nội dung file]';
      }
    } else {
      content = '[File không hỗ trợ đọc tự động]';
    }

    return `
 **Thông tin tài liệu:**
- **Tiêu đề:** ${doc.title}
- **ID:** \`${doc.id}\`
- **Môn học:** ${doc.subject?.name || 'N/A'}
- **Khoa:** ${doc.faculties?.map((f) => f.name).join(', ') || 'N/A'}
- **Loại:** ${doc.documentType?.name || 'N/A'}
- **Lượt tải:** ${doc.downloadCount}
- **Mô tả:** ${doc.description || 'Không có'}

 **Nội dung:**
${content}
    `.trim();
  }

  /**
   * Format document list
   */
  private formatDocumentList(title: string, documents: Document[]): string {
    const list = documents
      .map((doc, idx) =>
        `
${idx + 1}. **${doc.title}**
   - ID: \`${doc.id}\`
   - Môn: ${doc.subject?.name || 'N/A'}
   - Loại: ${doc.documentType?.name || 'N/A'}
   - Lượt tải: ${doc.downloadCount}
   - Mô tả: ${doc.description?.substring(0, 100) || 'Không có'}...
      `.trim()
      )
      .join('\n\n');

    return `${title} (${documents.length} tài liệu):\n\n${list}`;
  }

  /**
   * Extract text from file
   */
  private async extractTextFromFile(fileKey: string): Promise<string> {
    const fileBuffer = await this.s3Service.getFileBuffer(fileKey);
    let text = '';

    if (fileKey.toLowerCase().endsWith('.pdf')) {
      // Fix: Sử dụng pdfParse.default nếu có, hoặc pdfParse trực tiếp
      const pdfParser = (pdfParse as any).default || pdfParse;
      const data = await pdfParser(fileBuffer);
      text = data.text;
    } else if (fileKey.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
    } else {
      throw new BadRequestException('Loại file không được hỗ trợ');
    }

    // Clean and truncate
    text = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();

    if (text.length > this.MAX_TEXT_LENGTH) {
      text = text.substring(0, this.MAX_TEXT_LENGTH) + '...[nội dung bị cắt]';
    }

    return text;
  }

  /**
   * Check if file is processable
   */
  private isProcessableFile(fileKey: string): boolean {
    const ext = fileKey.toLowerCase();
    return ext.endsWith('.pdf') || ext.endsWith('.docx');
  }

  /**
   * Generate Gemini completion
   */
  private async generateCompletion(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      return text;
    } catch (error) {
      this.logger.error('Gemini error:', error);

      if (error.message?.includes('API key')) {
        throw new Error('Invalid API key');
      }
      if (error.message?.includes('quota')) {
        throw new Error('API quota exceeded');
      }

      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Generate completion with conversation history using Gemini chat
   */
  private async generateCompletionWithHistory(
    history: ChatHistoryItemDto[] | undefined,
    userMessage: string,
    context: string | null,
    systemPrompt: string
  ): Promise<string> {
    // Map history to Gemini format and trim
    const safeHistory = (history || [])
      .filter(
        (h) =>
          h &&
          typeof h.content === 'string' &&
          (h.role === UserRole.ADMIN || h.role === UserRole.STUDENT)
      )
      .slice(-10)
      .map((h) => ({
        role: h.role === UserRole.ADMIN ? 'model' : 'user',
        parts: [{ text: h.content.substring(0, 1000) }],
      }));

    const chat = this.model.startChat({ history: safeHistory });
    const composed = `${systemPrompt}\n\n${context ? `Context:\n${context}\n\n` : ''}User Question: ${userMessage}`;

    // Simple retry logic
    let lastError: any;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await chat.sendMessage(composed);
        const response = await result.response;
        const text = response.text();
        if (!text) throw new Error('Empty response from Gemini');
        return text;
      } catch (err) {
        lastError = err;
        this.logger.warn(`Gemini chat attempt ${attempt} failed: ${err?.message || err}`);
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    this.logger.error('Gemini error:', lastError);
    throw new Error('Failed to generate AI response');
  }

  /**
   * Get system prompt
   */
  private getSystemPrompt(): string {
    return `Bạn là trợ lý AI thông minh của ứng dụng quản lý tài liệu học tập dành cho sinh viên Đại học Bách Khoa - Đại học Quốc gia TP.HCM.

🎯 **Nhiệm vụ của bạn:**
- Tìm kiếm và gợi ý tài liệu học tập phù hợp
- Tóm tắt và giải thích nội dung tài liệu
- Trả lời câu hỏi về môn học và kiến thức

📋 **Nguyên tắc trả lời:**
1. **Ngôn ngữ:** Trả lời bằng tiếng Việt, rõ ràng, dễ hiểu
2. **Thái độ:** Thân thiện, nhiệt tình và hữu ích như một người bạn học
3. **Format:** Sử dụng markdown để trình bày đẹp mắt
4. **Độ chính xác:** Chỉ cung cấp thông tin từ context được cung cấp
5. **Tương tác:** Luôn đề xuất hành động tiếp theo
6. **Trích dẫn:** Khi đề cập tài liệu, luôn bao gồm ID để dễ truy cập

💡 **Lưu ý quan trọng:**
- Nếu không chắc chắn, hãy thừa nhận và gợi ý cách tìm hiểu thêm
- Nếu hỏi về tài liệu không có trong hệ thống, hãy lịch sự thông báo người dùng
- Nếu hỏi về các khái niệm chung, hãy trả lời chi tiết và dễ hiểu
- Nếu yêu cầu tóm tắt tài liệu, hãy cung cấp điểm chính và ý nghĩa
- Nếu yêu cầu tìm kiếm, hãy liệt kê các tài liệu phù hợp với thông tin chi tiết
- Khuyến khích sinh viên tự học và tìm hiểu sâu hơn
- Hỗ trợ cả tiếng Việt có dấu và không dấu`;
  }

  /**
   * Get suggested actions
   */
  private getSuggestedActions(intent: ChatIntent): string[] {
    const actions: Record<ChatIntent, string[]> = {
      [ChatIntent.SEARCH]: ['Xem chi tiết tài liệu', 'Tìm kiếm khác', 'Gợi ý cho tôi'],
      [ChatIntent.RECOMMEND]: ['Xem chi tiết', 'Tìm thêm', 'Theo dõi môn học'],
      [ChatIntent.SUMMARIZE]: ['Hỏi thêm chi tiết', 'Tải xuống', 'Tìm tài liệu tương tự'],
      [ChatIntent.DOCUMENT_QUESTION]: ['Hỏi thêm', 'Tóm tắt tài liệu', 'Tải xuống'],
      [ChatIntent.GENERAL]: ['Tìm kiếm', 'Gợi ý', 'Hỏi về môn học'],
    };

    return actions[intent] || [];
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.message?.includes('quota')) {
      return '⚠️ Hệ thống đang quá tải. Vui lòng thử lại sau vài phút.';
    }
    if (error.message?.includes('API key')) {
      return '⚠️ Lỗi cấu hình hệ thống. Vui lòng liên hệ quản trị viên.';
    }
    return '⚠️ Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
  }
}
