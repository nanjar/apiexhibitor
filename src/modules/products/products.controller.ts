import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { ProductSearchQueryDto } from './dto/product-search-query.dto';
import { CurrentUser, CurrentExhibitor } from '../../common/decorators/current-exhibitor.decorator';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Pencarian produk lintas company dalam 1 event.
  @Get('search')
  search(@CurrentUser() user: CurrentExhibitor, @Query() query: ProductSearchQueryDto) {
    return this.productsService.search(user.eventsId, query);
  }

  // Filter chip "All (24) | Automation | IoT | AI | Sensor"
  @Get('types')
  listTypes(@CurrentUser() user: CurrentExhibitor) {
    return this.productsService.listProductTypes(user.eventsId);
  }

  @Get('company/:companyId/:productId')
  getDetail(
    @CurrentUser() user: CurrentExhibitor,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.productsService.getDetail(user.eventsId, companyId, productId);
  }
}
