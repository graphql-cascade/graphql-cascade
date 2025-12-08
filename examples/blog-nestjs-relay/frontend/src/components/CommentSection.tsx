import { useState } from 'react'
import { useMutation } from 'react-relay'
import { graphql } from 'relay-runtime'

const CreateCommentMutation = graphql`
  mutation CommentSectionCreateCommentMutation($input: CreateCommentInput!) {
    createComment(input: $input) {
      success
      data {
        id
        content
        author {
          name
        }
      }
      error
    }
  }
`

interface Comment {
  id: string
  content: string
  author: {
    name: string
  }
}

interface CommentSectionProps {
  postId: string
  comments: Comment[]
}

function CommentSection({ postId, comments }: CommentSectionProps) {
  const [content, setContent] = useState('')
  const [authorId, setAuthorId] = useState('')

  const [commitMutation, isInFlight] = useMutation(CreateCommentMutation)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    commitMutation({
      variables: {
        input: { content, postId, authorId },
      },
      onCompleted: (response) => {
        if (response.createComment.success) {
          setContent('')
          // Cascade will automatically update the comments list
        }
      },
    })
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="font-medium mb-2">Comments</h4>

      {comments.map((comment) => (
        <div key={comment.id} className="mb-2 p-2 bg-gray-50 rounded">
          <p className="text-sm">{comment.content}</p>
          <p className="text-xs text-gray-600">By {comment.author.name}</p>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Add Comment</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            rows={2}
            required
          />
        </div>
        <div>
          <input
            type="text"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            placeholder="Author ID"
            className="border rounded px-3 py-2 text-sm mr-2"
            required
          />
          <button
            type="submit"
            disabled={isInFlight}
            className="bg-green-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
          >
            {isInFlight ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CommentSection