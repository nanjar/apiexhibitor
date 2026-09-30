import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ExhibitorProduct } from '../reports/entities/exhibitor-product.entity';
import { ExhibitorCompany } from '../exhibitors/entities/exhibitor-company.entity';
import { ProductTypesModule } from '../product-types/product-types.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExhibitorProduct, ExhibitorCompany]),
    ProductTypesModule,
    PassportModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
