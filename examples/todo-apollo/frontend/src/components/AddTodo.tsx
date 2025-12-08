import { useState } from 'react';
import { useCascadeMutation, gql } from '@graphql-cascade/apollo';

const CREATE_TODO = gql`
  mutation CreateTodo($title: String!) {
    createTodo(title: $title) {
      success
      data {
        id
        title
        completed
      }
      cascade {
        operation
        entityType
        entityId
      }
    }
  }
`;

function AddTodo() {
  const [title, setTitle] = useState('');
  const [createTodo] = useCascadeMutation(CREATE_TODO);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      createTodo({ variables: { title: title.trim() } });
      setTitle('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a new todo..."
      />
      <button type="submit">Add Todo</button>
    </form>
  );
}

export default AddTodo;