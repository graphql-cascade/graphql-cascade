import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PostsService } from './posts.service';
import { Post } from './post.model';
import { CascadeBuilder, buildSuccessResponse } from '@graphql-cascade/server';

@Resolver(() => Post)
export class PostsResolver {
  constructor(private postsService: PostsService) {}

  @Query(() => [Post])
  async posts() {
    return this.postsService.findAll();
  }

  @Query(() => Post, { nullable: true })
  async post(@Args('id', { type: () => ID }) id: string) {
    return this.postsService.findOne(id);
  }

  @Mutation(() => CreatePostResponse)
  async createPost(@Args('input') input: CreatePostInput) {
    const post = await this.postsService.create(input);
    return buildSuccessResponse(post, (builder: CascadeBuilder) => {
      builder.updated('Post', post);
      builder.updated('User', post.author);
    });
  }

  @Mutation(() => UpdatePostResponse)
  async updatePost(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePostInput,
  ) {
    const post = await this.postsService.update(id, input);
    return buildSuccessResponse(post, (builder: CascadeBuilder) => {
      builder.updated('Post', post);
    });
  }

  @Mutation(() => DeletePostResponse)
  async deletePost(@Args('id', { type: () => ID }) id: string) {
    const success = await this.postsService.delete(id);
    return buildSuccessResponse({ success }, (builder: CascadeBuilder) => {
      if (success) {
        builder.deleted('Post', { id });
      }
    });
  }
}

// Input/Output types
import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreatePostInput {
  @Field()
  title: string;

  @Field()
  content: string;

  @Field()
  authorId: string;
}

@InputType()
export class UpdatePostInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  content?: string;
}

@ObjectType()
export class CreatePostResponse {
  @Field()
  success: boolean;

  @Field(() => Post, { nullable: true })
  data?: Post;

  @Field(() => String, { nullable: true })
  error?: string;
}

@ObjectType()
export class UpdatePostResponse {
  @Field()
  success: boolean;

  @Field(() => Post, { nullable: true })
  data?: Post;

  @Field(() => String, { nullable: true })
  error?: string;
}

@ObjectType()
export class DeletePostResponse {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  error?: string;
}