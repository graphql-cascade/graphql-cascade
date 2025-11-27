import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsResolver } from './comments.resolver';
import { CommentsService } from './comments.service';
import { Comment } from './comment.model';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';

@Module({
  imports: [TypeOrmModule.forFeature([Comment, Post, User])],
  providers: [CommentsResolver, CommentsService],
})
export class CommentsModule {}