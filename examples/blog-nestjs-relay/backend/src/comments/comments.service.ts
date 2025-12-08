import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './comment.model';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private commentsRepository: Repository<Comment>,
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Comment[]> {
    return this.commentsRepository.find({ relations: ['post', 'author'] });
  }

  async findByPost(postId: string): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { post: { id: postId } },
      relations: ['post', 'author'],
    });
  }

  async create(input: { content: string; postId: string; authorId: string }): Promise<Comment> {
    const post = await this.postsRepository.findOne({ where: { id: input.postId } });
    const author = await this.usersRepository.findOne({ where: { id: input.authorId } });

    if (!post) throw new Error('Post not found');
    if (!author) throw new Error('Author not found');

    const comment = this.commentsRepository.create({
      content: input.content,
      post,
      author,
    });

    return this.commentsRepository.save(comment);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.commentsRepository.delete(id);
    return result.affected > 0;
  }
}