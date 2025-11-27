import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { User } from './user.model';
import { CascadeBuilder, buildSuccessResponse } from '@graphql-cascade/server';

@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  @Query(() => [User])
  async users() {
    return this.usersService.findAll();
  }

  @Query(() => User, { nullable: true })
  async user(@Args('id', { type: () => ID }) id: string) {
    return this.usersService.findOne(id);
  }

  @Mutation(() => CreateUserResponse)
  async createUser(@Args('input') input: CreateUserInput) {
    const user = await this.usersService.create(input);
    return buildSuccessResponse(user, (builder: CascadeBuilder) => {
      builder.updated('User', user);
    });
  }

  @Mutation(() => UpdateUserResponse)
  async updateUser(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ) {
    const user = await this.usersService.update(id, input);
    return buildSuccessResponse(user, (builder: CascadeBuilder) => {
      builder.updated('User', user);
    });
  }

  @Mutation(() => DeleteUserResponse)
  async deleteUser(@Args('id', { type: () => ID }) id: string) {
    const success = await this.usersService.delete(id);
    return buildSuccessResponse({ success }, (builder: CascadeBuilder) => {
      if (success) {
        builder.deleted('User', { id });
      }
    });
  }
}

// Input/Output types
import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreateUserInput {
  @Field()
  name: string;

  @Field()
  email: string;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  email?: string;
}

@ObjectType()
export class CreateUserResponse {
  @Field()
  success: boolean;

  @Field(() => User, { nullable: true })
  data?: User;

  @Field(() => String, { nullable: true })
  error?: string;
}

@ObjectType()
export class UpdateUserResponse {
  @Field()
  success: boolean;

  @Field(() => User, { nullable: true })
  data?: User;

  @Field(() => String, { nullable: true })
  error?: string;
}

@ObjectType()
export class DeleteUserResponse {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  error?: string;
}