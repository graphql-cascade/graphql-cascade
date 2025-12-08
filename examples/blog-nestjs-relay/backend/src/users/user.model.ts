import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Post } from '../posts/post.model';
import { Comment } from '../comments/comment.model';

@ObjectType()
@Entity()
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column({ unique: true })
  email: string;

  @Field(() => [Post])
  @OneToMany(() => Post, post => post.author)
  posts: Post[];

  @Field(() => [Comment])
  @OneToMany(() => Comment, comment => comment.author)
  comments: Comment[];

  @Field()
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}