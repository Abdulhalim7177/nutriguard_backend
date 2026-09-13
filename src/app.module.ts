import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NutritionModule } from './nutrition/nutrition.module';

@Module({
  imports: [NutritionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
