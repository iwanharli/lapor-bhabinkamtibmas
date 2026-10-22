import { Module } from '@nestjs/common';
import { UnitsModule } from '../units/units.module';
import { UsersController } from './users.controller';
import { UsersImportService } from './users-import.service';
import { UsersService } from './users.service';

@Module({ imports: [UnitsModule], providers: [UsersService, UsersImportService], controllers: [UsersController] })
export class UsersModule {}
