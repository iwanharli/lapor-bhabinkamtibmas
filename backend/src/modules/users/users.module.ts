import { Module } from '@nestjs/common';
import { FaceModule } from '../face/face.module';
import { UnitsModule } from '../units/units.module';
import { UsersController } from './users.controller';
import { UsersImportService } from './users-import.service';
import { UsersService } from './users.service';

@Module({ imports: [UnitsModule, FaceModule], providers: [UsersService, UsersImportService], controllers: [UsersController] })
export class UsersModule {}
