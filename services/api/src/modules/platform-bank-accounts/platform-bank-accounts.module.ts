import { Module } from "@nestjs/common";
import { PlatformBankAccountsController } from "./platform-bank-accounts.controller";
import { PlatformBankAccountsService } from "./platform-bank-accounts.service";

@Module({
	controllers: [PlatformBankAccountsController],
	providers: [PlatformBankAccountsService],
	exports: [PlatformBankAccountsService],
})
export class PlatformBankAccountsModule {}
