import { useLazyLoadQuery } from 'react-relay'
import { graphql } from 'relay-runtime'
import PostEditor from './PostEditor'
import CommentSection from './CommentSection'

const PostListQuery = graphql`
  query PostListQuery {
    posts {
      id
      title
      content
      author {
        id
        name
      }
      comments {
        id
        content
        author {
          name
        }
      }
      createdAt
    }
  }
`

function PostList() {
  const data = useLazyLoadQuery(PostListQuery, {})

  return (
    <div className="space-y-6">
      <PostEditor />
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Posts</h2>
        {data.posts.map((post) => (
          <div key={post.id} className="border rounded-lg p-4">
            <h3 className="text-lg font-medium">{post.title}</h3>
            <p className="text-gray-600">By {post.author.name}</p>
            <p className="mt-2">{post.content}</p>
            <CommentSection postId={post.id} comments={post.comments} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default PostList