import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { NutritionController } from './nutrition.controller';
import { NutritionService } from './nutrition.service';

@Module({
  imports: [CacheModule.register()],
  controllers: [NutritionController],
  providers: [NutritionService],
})
export class NutritionModule {}
