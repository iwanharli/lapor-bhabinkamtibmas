import { Global, Module } from '@nestjs/common';
import { SensitiveDataService } from './sensitive-data.service';

@Global()
@Module({ providers: [SensitiveDataService], exports: [SensitiveDataService] })
export class CryptoModule {}
