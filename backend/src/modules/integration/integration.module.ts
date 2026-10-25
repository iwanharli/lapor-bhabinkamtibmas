import { Module } from '@nestjs/common';
import { IntegrationTokensController } from './integration-tokens.controller';
import { IntegrationTokensService } from './integration-tokens.service';
import { IntegrationController } from './integration.controller';
import { IntegrationGuard } from './integration.guard';
import { IntegrationService } from './integration.service';

@Module({
  providers: [IntegrationService, IntegrationGuard, IntegrationTokensService],
  controllers: [IntegrationController, IntegrationTokensController],
  exports: [IntegrationTokensService],
})
export class IntegrationModule {}
