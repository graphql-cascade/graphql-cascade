import { useState } from 'react'
import { useMutation } from 'react-relay'
import { graphql } from 'relay-runtime'

const CreatePostMutation = graphql`
  mutation PostEditorCreatePostMutation($input: CreatePostInput!) {
    createPost(input: $input) {
      success
      data {
        id
        title
        content
        author {
          id
          name
        }
      }
      error
    }
  }
`

function PostEditor() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [authorId, setAuthorId] = useState('')

  const [commitMutation, isInFlight] = useMutation(CreatePostMutation)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    commitMutation({
      variables: {
        input: { title, content, authorId },
      },
      onCompleted: (response) => {
        if (response.createPost.success) {
          setTitle('')
          setContent('')
          // Cascade will automatically update the PostList
        }
      },
    })
  }

  return (
    <div className="border rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Create New Post</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={4}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Author ID</label>
          <input
            type="text"
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter author ID"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isInFlight}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isInFlight ? 'Creating...' : 'Create Post'}
        </button>
      </form>
    </div>
  )
}

export default PostEditor