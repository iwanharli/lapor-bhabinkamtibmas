import { Module } from '@nestjs/common';
import { FormSchemasController } from './form-schemas.controller';

@Module({ controllers: [FormSchemasController] })
export class FormSchemasModule {}
