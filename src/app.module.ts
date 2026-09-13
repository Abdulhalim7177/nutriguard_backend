import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { NutritionModule } from './nutrition/nutrition.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NutritionModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
