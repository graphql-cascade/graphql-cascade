import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.model';
import { User } from '../users/user.model';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.postsRepository.find({ relations: ['author', 'comments'] });
  }

  async findOne(id: string): Promise<Post | null> {
    return this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'comments'],
    });
  }

  async create(input: { title: string; content: string; authorId: string }): Promise<Post> {
    const author = await this.usersRepository.findOne({ where: { id: input.authorId } });
    if (!author) throw new Error('Author not found');

    const post = this.postsRepository.create({
      title: input.title,
      content: input.content,
      author,
    });

    return this.postsRepository.save(post);
  }

  async update(id: string, input: Partial<{ title: string; content: string }>): Promise<Post> {
    await this.postsRepository.update(id, input);
    const post = await this.findOne(id);
    if (!post) throw new Error('Post not found');
    return post;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.postsRepository.delete(id);
    return result.affected > 0;
  }
}