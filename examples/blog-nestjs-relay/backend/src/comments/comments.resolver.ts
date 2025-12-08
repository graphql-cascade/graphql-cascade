import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CommentsService } from './comments.service';
import { Comment } from './comment.model';
import { CascadeBuilder, buildSuccessResponse } from '@graphql-cascade/server';

@Resolver(() => Comment)
export class CommentsResolver {
  constructor(private commentsService: CommentsService) {}

  @Query(() => [Comment])
  async comments() {
    return this.commentsService.findAll();
  }

  @Query(() => [Comment])
  async commentsByPost(@Args('postId', { type: () => ID }) postId: string) {
    return this.commentsService.findByPost(postId);
  }

  @Mutation(() => CreateCommentResponse)
  async createComment(@Args('input') input: CreateCommentInput) {
    const comment = await this.commentsService.create(input);
    return buildSuccessResponse(comment, (builder: CascadeBuilder) => {
      builder.updated('Comment', comment);
      builder.updated('Post', comment.post);
      builder.updated('User', comment.author);
    });
  }

  @Mutation(() => DeleteCommentResponse)
  async deleteComment(@Args('id', { type: () => ID }) id: string) {
    const success = await this.commentsService.delete(id);
    return buildSuccessResponse({ success }, (builder: CascadeBuilder) => {
      if (success) {
        builder.deleted('Comment', { id });
      }
    });
  }
}

// Input/Output types
import { InputType, Field, ObjectType } from '@nestjs/graphql';

@InputType()
export class CreateCommentInput {
  @Field()
  content: string;

  @Field()
  postId: string;

  @Field()
  authorId: string;
}

@ObjectType()
export class CreateCommentResponse {
  @Field()
  success: boolean;

  @Field(() => Comment, { nullable: true })
  data?: Comment;

  @Field(() => String, { nullable: true })
  error?: string;
}

@ObjectType()
export class DeleteCommentResponse {
  @Field()
  success: boolean;

  @Field(() => String, { nullable: true })
  error?: string;
}