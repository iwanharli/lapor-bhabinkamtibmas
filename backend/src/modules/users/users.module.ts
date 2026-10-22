import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({ imports: [UnitsModule], providers: [UsersService], controllers: [UsersController] })
export class UsersModule {}
