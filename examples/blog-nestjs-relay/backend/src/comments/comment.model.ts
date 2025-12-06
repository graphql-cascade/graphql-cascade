import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';

@ObjectType()
@Entity()
export class Comment {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column('text')
  content: string;

  @Field(() => Post)
  @ManyToOne(() => Post, post => post.comments, { eager: true })
  post: Post;

  @Field(() => User)
  @ManyToOne(() => User, user => user.comments, { eager: true })
  author: User;

  @Field()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}