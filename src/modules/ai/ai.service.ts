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
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
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
   * Main chat handler with 2-step AI calls
   */
  async chat(
    message: string,
    userId: string,
    history?: ChatHistoryItemDto[]
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    this.logger.log(`Processing chat from user ${userId}: ${message.substring(0, 50)}...`);

    try {
      // Step 1: First AI call to analyze intent and extract information for database query
      this.logger.log('Step 1: Analyzing user query with AI...');
      const analysisPrompt = this.getAnalysisPrompt(message, userId, history);
      const analysisResult = await this.generateCompletion(analysisPrompt);

      // Parse analysis result to extract intent and parameters
      const { intent, documentId, keywords, positionInList, needsContext } =
        this.parseAnalysisResult(analysisResult, message);
      this.logger.log(
        `Analysis result - Intent: ${intent}, Keywords: ${keywords?.join(', ') || 'none'}, Position: ${positionInList || 'none'}`
      );

      // Build context from database based on analysis
      let context = '';
      if (needsContext) {
        context = await this.buildContextFromAnalysis(
          intent,
          userId,
          documentId,
          keywords,
          positionInList
        );
        this.logger.log(`Context built: ${context.substring(0, 100)}...`);
      }

      // Step 2: Second AI call to generate final response with context
      this.logger.log('Step 2: Generating final response with AI...');
      const systemPrompt = this.getSystemPrompt();
      let reply: string;

      try {
        reply = await this.generateCompletionWithHistory(history, message, context, systemPrompt);
      } catch (e) {
        // Fallback: try single-prompt generation
        try {
          const fullPrompt = context
            ? `${systemPrompt}\n\n**Context:**\n${context}\n\n**User Question:** ${message}`
            : `${systemPrompt}\n\n**User Question:** ${message}`;
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
   * Get analysis prompt for first AI call
   */
  private getAnalysisPrompt(
    message: string,
    userId: string,
    history?: ChatHistoryItemDto[]
  ): string {
    // Include recent history context if available
    let historyContext = '';
    if (history && history.length > 0) {
      const recentHistory = history.slice(-2); // Last 2 messages
      historyContext =
        '\n\n**Lịch sử hội thoại gần đây:**\n' +
        recentHistory.map((h) => `- ${h.role}: ${h.content.substring(0, 300)}`).join('\n');
    }

    return `Bạn là trợ lý AI phân tích yêu cầu của sinh viên về tài liệu học tập.

Phân tích câu hỏi sau và trả về JSON theo định dạng:
{
  "intent": "SEARCH" | "RECOMMEND" | "SUMMARIZE" | "DOCUMENT_QUESTION" | "GENERAL",
  "keywords": ["keyword1", "keyword2"],
  "documentId": "uuid hoặc null",
  "positionInList": số thứ tự hoặc null,
  "needsContext": true | false,
  "explanation": "Giải thích ngắn gọn"
}

**Hướng dẫn:**
- SEARCH: Tìm kiếm tài liệu (ví dụ: "tìm tài liệu về cơ sở dữ liệu")
- RECOMMEND: Gợi ý tài liệu phù hợp (ví dụ: "gợi ý cho tôi", "đề xuất tài liệu")
- SUMMARIZE: Tóm tắt tài liệu (ví dụ: "tóm tắt tài liệu abc-123" hoặc "tóm tắt tài liệu đầu tiên")
- DOCUMENT_QUESTION: Hỏi về nội dung tài liệu (ví dụ: "giải thích khái niệm X trong tài liệu")
- GENERAL: Câu hỏi chung không liên quan đến tài liệu cụ thể

- keywords: Trích xuất từ khóa quan trọng từ câu hỏi. Nếu người dùng tham chiếu đến kết quả tìm kiếm trước (đầu tiên, thứ hai), hãy lấy keywords từ lịch sử.
- documentId: Trích xuất UUID nếu có trong câu hỏi hoặc lịch sử
- positionInList: Nếu người dùng đề cập "đầu tiên/thứ nhất" → 1, "thứ hai" → 2, etc. Nếu không đề cập → null
- needsContext: true nếu cần truy vấn database để lấy thông tin tài liệu
${historyContext}

**Câu hỏi của sinh viên:** ${message}

Trả về CHÍNH XÁC JSON, không thêm text nào khác:`;
  }

  /**
   * Parse analysis result from first AI call
   */
  private parseAnalysisResult(
    analysisResult: string,
    originalMessage: string
  ): {
    intent: ChatIntent;
    documentId: string | null;
    keywords: string[];
    positionInList: number | null;
    needsContext: boolean;
  } {
    try {
      // Extract JSON from response (in case AI adds extra text)
      const jsonMatch = analysisResult.match(/\{[^}]+\}/s);
      if (!jsonMatch) {
        this.logger.warn('No JSON found in analysis result, falling back to pattern detection');
        return this.fallbackAnalysis(originalMessage);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        intent: this.mapIntentString(parsed.intent),
        documentId: parsed.documentId || this.extractDocumentId(originalMessage),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        positionInList: typeof parsed.positionInList === 'number' ? parsed.positionInList : null,
        needsContext: parsed.needsContext !== false,
      };
    } catch (error) {
      this.logger.error('Failed to parse analysis result:', error);
      this.logger.warn('Falling back to pattern detection');
      return this.fallbackAnalysis(originalMessage);
    }
  }

  /**
   * Map intent string to ChatIntent enum
   */
  private mapIntentString(intentStr: string): ChatIntent {
    const upperIntent = intentStr?.toUpperCase();
    switch (upperIntent) {
      case 'SEARCH':
        return ChatIntent.SEARCH;
      case 'RECOMMEND':
        return ChatIntent.RECOMMEND;
      case 'SUMMARIZE':
        return ChatIntent.SUMMARIZE;
      case 'DOCUMENT_QUESTION':
        return ChatIntent.DOCUMENT_QUESTION;
      default:
        return ChatIntent.GENERAL;
    }
  }

  /**
   * Fallback analysis when AI parsing fails
   */
  private fallbackAnalysis(message: string): {
    intent: ChatIntent;
    documentId: string | null;
    keywords: string[];
    positionInList: number | null;
    needsContext: boolean;
  } {
    const intent = this.detectIntent(message);
    const documentId = this.extractDocumentId(message);
    const keywords = this.extractSearchKeywords(message);
    const positionInList = this.extractPositionInList(message);

    return {
      intent,
      documentId,
      keywords,
      positionInList,
      needsContext: intent !== ChatIntent.GENERAL,
    };
  }

  /**
   * Extract position in list from message (fallback method)
   */
  private extractPositionInList(message: string): number | null {
    const lower = message.toLowerCase();

    // Check for position keywords
    if (lower.match(/đầu\s*tiên|thứ\s*nhất|cái\s*đầu|first/i)) {
      return 1;
    }
    if (lower.match(/thứ\s*hai|thứ\s*2|second/i)) {
      return 2;
    }
    if (lower.match(/thứ\s*ba|thứ\s*3|third/i)) {
      return 3;
    }

    return null;
  }

  /**
   * Detect intent from message (fallback method)
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
   * Build context from analysis result (after first AI call)
   */
  private async buildContextFromAnalysis(
    intent: ChatIntent,
    userId: string,
    documentId: string | null,
    keywords: string[],
    positionInList: number | null = null
  ): Promise<string> {
    try {
      switch (intent) {
        case ChatIntent.SEARCH:
          return await this.buildSearchContextWithKeywords(keywords);

        case ChatIntent.RECOMMEND:
          return await this.buildRecommendContext(userId);

        case ChatIntent.DOCUMENT_QUESTION:
        case ChatIntent.SUMMARIZE:
          // If positionInList is specified but no documentId, search and get document at that position
          if (!documentId && positionInList && keywords.length > 0) {
            this.logger.log(`Getting document at position ${positionInList} from search results`);
            return await this.buildContextForPositionInList(keywords, positionInList);
          }

          if (!documentId) {
            return 'Vui lòng cung cấp ID tài liệu hoặc tìm kiếm trước (ví dụ: "Tóm tắt tài liệu abc-123-xyz" hoặc "Tìm tài liệu về SQL rồi tóm tắt cái đầu tiên")';
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
   * Build context for document at specific position in search results
   */
  private async buildContextForPositionInList(
    keywords: string[],
    position: number
  ): Promise<string> {
    // Search documents
    const documents = await this.documentsService.searchActiveDocumentsByKeywords(
      keywords,
      position + 2
    );

    if (documents.length === 0) {
      return `Không tìm thấy tài liệu nào với từ khóa: "${keywords.join('", "')}"`;
    }

    if (position > documents.length) {
      return `Chỉ tìm thấy ${documents.length} tài liệu, không có tài liệu thứ ${position}.`;
    }

    // Get document at specified position (1-based index)
    const targetDoc = documents[position - 1];
    this.logger.log(`Found document at position ${position}: ${targetDoc.title} (${targetDoc.id})`);

    // Build full context for this document
    return await this.buildDocumentContext(targetDoc.id);
  }

  /**
   * Build context based on intent (legacy method for compatibility)
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
   * Build search context with keywords from AI analysis
   */
  private async buildSearchContextWithKeywords(keywords: string[]): Promise<string> {
    if (!keywords || keywords.length === 0) {
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
   * Build search context with smart keyword extraction (legacy)
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

    this.logger.log(`Building context for document: ${doc.title} (${doc.fileKey})`);

    let content = '';
    if (this.isProcessableFile(doc.fileKey)) {
      try {
        this.logger.log(`Extracting text from file: ${doc.fileKey}`);
        content = await this.extractTextFromFile(doc.fileKey);
        this.logger.log(`Successfully extracted ${content.length} characters from ${doc.fileKey}`);

        if (!content || content.trim().length === 0) {
          content =
            '[File không có nội dung văn bản hoặc nội dung trống. File có thể là hình ảnh scan chưa OCR.]';
        }
      } catch (error) {
        this.logger.error(`Failed to extract content from ${doc.fileKey}:`, error);
        content = `[Không thể đọc nội dung file. Lỗi: ${error.message || 'Unknown error'}]`;
      }
    } else {
      const fileExt = doc.fileKey.split('.').pop()?.toUpperCase() || 'Unknown';
      content = `[File định dạng ${fileExt} không hỗ trợ đọc tự động. Chỉ hỗ trợ PDF và DOCX.]`;
      this.logger.warn(`File type not supported for extraction: ${doc.fileKey}`);
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
    this.logger.log(`Downloading file from S3: ${fileKey}`);
    const fileBuffer = await this.s3Service.getFileBuffer(fileKey);
    this.logger.log(`Downloaded ${fileBuffer.length} bytes`);

    let text = '';

    if (fileKey.toLowerCase().endsWith('.pdf')) {
      this.logger.log('Parsing PDF file...');
      // Create a new PDFParse instance for each file
      const pdfParser = new PDFParse({ data: fileBuffer });
      const textResult = await pdfParser.getText();
      text = textResult.text;
      this.logger.log(`Extracted ${text.length} characters from PDF`);
    } else if (fileKey.toLowerCase().endsWith('.docx')) {
      this.logger.log('Parsing DOCX file...');
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
      this.logger.log(`Extracted ${text.length} characters from DOCX`);
    } else if (fileKey.toLowerCase().endsWith('.txt')) {
      this.logger.log('Reading TXT file...');
      text = fileBuffer.toString('utf-8');
      this.logger.log(`Read ${text.length} characters from TXT`);
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
    return ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.txt');
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
