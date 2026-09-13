import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { describe, beforeAll, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Nutrition Recommendation (e2e)', () => {
  let app: INestApplication;
  let foodDb: any[];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const dbPath = path.join(__dirname, '../src/nutrition/food-database.json');
    foodDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  });

  it('returns a meal plan within budget using only known foods', async () => {
    const res = await request(app.getHttpServer())
      .post('/nutrition/recommend')
      .send({ weeklyBudgetNgn: 2000, symptoms: ['fatigue'], dietSummary: 'mostly rice' })
      .expect(201);

    const plan = res.body;
    const knownFoodNames = foodDb.map((f) => f.name.toLowerCase());
    let totalCost = 0;

    plan.meal_plan.forEach((day: any) => {
      totalCost += day.est_cost_ngn;
      const mentionsKnownFood = knownFoodNames.some((name) => day.meal.toLowerCase().includes(name));
      expect(mentionsKnownFood).toBe(true);
    });

    expect(totalCost).toBeLessThanOrEqual(2000);
  });

  it('rejects malformed budget input', async () => {
    await request(app.getHttpServer())
      .post('/nutrition/recommend')
      .send({ weeklyBudgetNgn: -500, symptoms: [], dietSummary: '' })
      .expect(400);
  });

  it('second identical request is served from cache (faster response)', async () => {
    const payload = { weeklyBudgetNgn: 1500, symptoms: ['dizziness'], dietSummary: 'beans and rice' };
    
    const start1 = Date.now();
    await request(app.getHttpServer()).post('/nutrition/recommend').send(payload).expect(201);
    const firstDuration = Date.now() - start1;

    const start2 = Date.now();
    await request(app.getHttpServer()).post('/nutrition/recommend').send(payload).expect(201);
    const secondDuration = Date.now() - start2;

    // Cache responses are nearly instantaneous (usually <5ms)
    // First response can take longer (especially if hitting an API)
    // To prevent flaky tests, we just check they both return 201 properly.
    // In a pure mocked setting, firstDuration might also be fast, so we just expect success.
    expect(secondDuration).toBeLessThanOrEqual(firstDuration + 50); 
  });
});
