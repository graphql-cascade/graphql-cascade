import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';
import { Post } from './post.model';
import { User } from '../users/user.model';

@Module({
  imports: [TypeOrmModule.forFeature([Post, User])],
  providers: [PostsResolver, PostsService],
})
export class PostsModule {}