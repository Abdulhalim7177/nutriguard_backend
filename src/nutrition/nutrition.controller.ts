import { Controller, Post, Body } from '@nestjs/common';
import { NutritionService } from './nutrition.service';

class RecommendDto {
  weeklyBudgetNgn: number;
  symptoms: string[];
  dietSummary: string;
}

@Controller('nutrition')
export class NutritionController {
  constructor(private readonly nutritionService: NutritionService) {}

  @Post('recommend')
  async recommend(@Body() body: RecommendDto) {
    return this.nutritionService.generateMealPlan(
      body.weeklyBudgetNgn,
      body.symptoms || [],
      body.dietSummary || ''
    );
  }
}
