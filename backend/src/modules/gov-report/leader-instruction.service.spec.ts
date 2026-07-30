import { BadRequestException } from '@nestjs/common';
import { LeaderInstructionService } from './leader-instruction.service';
function createRepo() {
  return {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    exist: jest.fn(),
  };
}

describe('LeaderInstructionService', () => {
  it('rejects instructions for missing events', async () => {
    const eventRepo = createRepo();
    eventRepo.exist.mockResolvedValue(false);
    const service = new LeaderInstructionService(createRepo() as any, eventRepo as any);

    await expect(
      service.create({
        eventId: 99,
        leaderName: '张市长',
        instruction: '请核实处理',
        createdBy: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires feedback before completing an instruction', async () => {
    const instructionRepo = createRepo();
    instructionRepo.findOne.mockResolvedValue({
      id: 1,
      status: 'processing',
      feedback: null,
    });
    const service = new LeaderInstructionService(instructionRepo as any, createRepo() as any);

    await expect(
      service.update(1, { status: 'completed' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents completed instructions from reverting', async () => {
    const instructionRepo = createRepo();
    instructionRepo.findOne.mockResolvedValue({
      id: 1,
      status: 'completed',
      feedback: '已完成',
    });
    const service = new LeaderInstructionService(instructionRepo as any, createRepo() as any);

    await expect(
      service.update(1, { status: 'processing' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
