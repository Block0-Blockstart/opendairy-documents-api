import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Serialize } from '../../common/decorators/serialize.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CheckAddressDto } from './dtos/request/check-address.dto';
import { CreateUserDto } from './dtos/request/create-user.dto';
import { TxcRegisterEthAccountDto } from './dtos/request/txc-register-eth-account.dto';
import { TxfRegisterEthAccountDto } from './dtos/request/txf-register-eth-account.dto';
import { UpdateUserDto } from './dtos/request/update-user.dto';
import { UserDto } from './dtos/response/user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

/* ************************************************************************** *
 * *** DEV NOTES: ***
 *
 * ===> This prototype does not implement a model for "deals" (deals are part
 * of the OD project, not this prototype). But we still need to retrieve the
 * people from which a document can be required. In the prototype scope, we
 * will "get all users" and the frontend will then filter those having an eth
 * address. It means anyone can ask a doc to anyone having an address.
 * Once integrated in OD system, there should be a controller returning only
 * the users who are part of a specific deal (and having an eth address).
 * ************************************************************************* */

@Controller()
@Serialize(UserDto)
export class UsersController {
  constructor(private userService: UsersService) {}

  ///////////////////////////
  ///  NOT PROTECTED      ///
  ///////////////////////////

  @Post('user/signup')
  createUser(@Body() body: CreateUserDto) {
    return this.userService.create(body.email, body.password);
  }

  //check that an email is linked to an eth address
  @Get('user/check-address')
  async checkAddress(@Query() query: CheckAddressDto) {
    return this.userService.checkAddress(query.email, query.address);
  }

  ///////////////////////////
  ///     PROTECTED       ///
  ///////////////////////////

  @Get('user')
  @UseGuards(AuthGuard)
  findUser(@CurrentUser() user: User) {
    return this.userService.findOne(user.id, true);
  }

  @Get('users')
  @UseGuards(AuthGuard)
  findAllUsers() {
    return this.userService.findAll();
  }

  @Post('user/tx-create/register-eth')
  @UseGuards(AuthGuard)
  txcRegisterEthAccount(@CurrentUser() user: User, @Body() dto: TxcRegisterEthAccountDto) {
    return this.userService.txcRegisterEthAccount(user, dto);
  }

  @Post('user/tx-forward/register-eth')
  @UseGuards(AuthGuard)
  txfRegisterEthAccount(@CurrentUser() user: User, @Body() dto: TxfRegisterEthAccountDto) {
    return this.userService.txfRegisterEthAccount(user, dto);
  }

  @Patch('user')
  @UseGuards(AuthGuard)
  updateUser(@CurrentUser() user: User, @Body() body: UpdateUserDto) {
    return this.userService.update(user.id, body, true);
  }

  @Delete('user')
  @UseGuards(AuthGuard)
  deleteUser(@CurrentUser() user: User) {
    return this.userService.setDeleted(user.id);
  }
}
