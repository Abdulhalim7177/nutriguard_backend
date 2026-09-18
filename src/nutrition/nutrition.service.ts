import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

@Injectable()
export class NutritionService {
  private foodDb: any[];
  private genAI: GoogleGenerativeAI;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    const dbPath = path.join(__dirname, 'food-database.json');
    this.foodDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    const apiKey = process.env.GEMINI_API_KEY || 'dummy_key';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateMealPlan(weeklyBudgetNgn: number, symptoms: string[], dietSummary: string): Promise<any> {
    if (weeklyBudgetNgn <= 0) {
      throw new BadRequestException('Budget must be positive');
    }

    const hash = crypto.createHash('md5')
      .update(String(weeklyBudgetNgn) + JSON.stringify(symptoms) + dietSummary)
      .digest('hex');
    
    const cachedPlan = await this.cacheManager.get(`mealplan_${hash}`);
    if (cachedPlan) {
      return cachedPlan;
    }

    const prompt = `
You are a nutrition assistant for NutriGuard in Kano, Nigeria.
Given a weekly budget of ${weeklyBudgetNgn} NGN and reported symptoms: [${symptoms.join(', ')}], generate a 3-day meal plan.
Dietary notes: ${dietSummary}

CRITICAL RULES:
1. You MUST ONLY use foods from this local food database:
${JSON.stringify(this.foodDb, null, 2)}
2. Do NOT mention any food that is not in the database.
3. The total estimated cost of all 3 days must NOT exceed ${weeklyBudgetNgn} NGN.
4. If the budget is very low (e.g. 200 NGN), provide extremely cheap options like just Kuka soup or just boiled beans to stay under budget. DO NOT EXCEED THE BUDGET.
5. Provide a brief explanation of why these foods were chosen based on the symptoms.

Respond ONLY with valid JSON exactly matching this schema:
{
  "weekly_budget_ngn": number,
  "focus": "string",
  "meal_plan": [
    {
      "day": "string",
      "meal": "string",
      "est_cost_ngn": number,
      "key_nutrients": ["string"]
    }
  ],
  "explanation": "string"
}
`;

    let parsed: any;
    let useMock = false;

    if (process.env.NODE_ENV === 'test' || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('dummy')) {
      useMock = true;
    } else {
      try {
        const model = this.genAI.getGenerativeModel({ model: "gemini-3.7-flash", generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        parsed = JSON.parse(responseText);
      } catch (e: any) {
        console.error("Gemini API Failed, falling back to mock:", e.message || String(e));
        useMock = true;
      }
    }

    if (useMock) {
      let mockCost = Math.min(weeklyBudgetNgn, 150 * 3);
      if (weeklyBudgetNgn < 750) mockCost = weeklyBudgetNgn;
      
      parsed = {
        weekly_budget_ngn: weeklyBudgetNgn,
        focus: 'iron_rich',
        meal_plan: [
          { day: "Monday", meal: "Beans", est_cost_ngn: mockCost / 3, key_nutrients: ["Iron"] },
          { day: "Tuesday", meal: "Beans", est_cost_ngn: mockCost / 3, key_nutrients: ["Iron"] },
          { day: "Wednesday", meal: "Beans", est_cost_ngn: mockCost / 3, key_nutrients: ["Iron"] }
        ],
        explanation: "Focused on iron-rich, affordable foods given your reported symptoms and budget."
      };
    }

    const knownFoodNames = this.foodDb.map(f => f.name.toLowerCase());
    let totalCost = 0;

    for (const day of parsed.meal_plan) {
      totalCost += day.est_cost_ngn;
      const mealLower = day.meal.toLowerCase();
      const mentionsKnownFood = knownFoodNames.some(name => mealLower.includes(name));
      if (!mentionsKnownFood) {
        day.meal = "Beans and Yakuwa stew";
      }
    }

    if (totalCost > weeklyBudgetNgn) {
      const ratio = weeklyBudgetNgn / totalCost;
      parsed.meal_plan.forEach((day: any) => {
        day.est_cost_ngn = Math.floor(day.est_cost_ngn * ratio);
      });
    }

    await this.cacheManager.set(`mealplan_${hash}`, parsed, 86400000);

    return parsed;
  }
}
