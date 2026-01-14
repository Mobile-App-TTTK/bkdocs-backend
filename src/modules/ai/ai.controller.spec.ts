// import { Test, TestingModule } from '@nestjs/testing';
// import { AiController } from './ai.controller';
// import { AiService } from './ai.service';

// describe('AiController', () => {
//   let controller: AiController;
//   let service: AiService;
//   let app: TestingModule;

//   beforeEach(async () => {
//     app = await Test.createTestingModule({
//       controllers: [AiController],
//       providers: [
//         {
//           provide: AiService,
//           useValue: {
//             chat: jest.fn(),
//             analyzeIntent: jest.fn(),
//             searchDocuments: jest.fn(),
//             getDocumentDetails: jest.fn(),
//             buildContext: jest.fn(),
//             extractContentFromDocument: jest.fn(),
//           },
//         },
//       ],
//     }).compile();

//     controller = app.get<AiController>(AiController);
//     service = app.get<AiService>(AiService);
//   });

//   afterEach(async () => {
//     if (app) {
//       await app.close();
//     }
//   });

//   it('should be defined', () => {
//     expect(controller).toBeDefined();
//   });

//   it('should have service injected', () => {
//     expect(service).toBeDefined();
//   });
// });
