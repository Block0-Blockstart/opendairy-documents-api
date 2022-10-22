import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AdminUpdateUserDto } from './dto/request/admin-update-user.dto';
import { SignTxDto } from './dto/request/unsigned-tx.dto';
import { AdminUserDto } from './dto/response/admin-user-dto';

@Controller('admin')
@UseGuards(AdminGuard)
@Serialize(AdminUserDto)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  findAllUsers() {
    return this.adminService.findAll(); // database users
  }

  @Get('accounts')
  findAllAccounts() {
    return this.adminService.allAccounts(); // smart contract registered accounts
  }

  @Post('user/create-in-database')
  createUserInDatabase(@Body() body: { email: string }) {
    return this.adminService.createUserInDatabase(body.email);
  }

  @Post('contract/create-accounts')
  async deployAccountsContract() {
    return JSON.stringify(await this.adminService.deployAccountsContract());
  }

  @Post('contract/sign-tx')
  async signTx(@Body() signTxDto: SignTxDto) {
    return this.adminService.signTx(signTxDto);
  }

  ///////////////////////////
  ///  CATCH ALL GATES    ///
  ///////////////////////////

  @Get('user/:id')
  findUser(@Param('id') id: string) {
    return this.adminService.findOne(id);
  }

  @Patch('user/:id')
  updateUser(@Param('id') id: string, @Body() body: AdminUpdateUserDto) {
    return this.adminService.update(id, body);
  }

  @Delete('user/:id')
  removeUserFromDatabase(@Param('id') id: string) {
    return this.adminService.removeUserFromDatabase(id);
  }
}
