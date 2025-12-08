import { useCascadeMutation, gql } from '@graphql-cascade/apollo';

const TOGGLE_TODO = gql`
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
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

const DELETE_TODO = gql`
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
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

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
}

function TodoItem({ todo }: TodoItemProps) {
  const [toggleTodo] = useCascadeMutation(TOGGLE_TODO);
  const [deleteTodo] = useCascadeMutation(DELETE_TODO);

  const handleToggle = () => {
    toggleTodo({ variables: { id: todo.id } });
  };

  const handleDelete = () => {
    deleteTodo({ variables: { id: todo.id } });
  };

  return (
    <li>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={handleToggle}
      />
      <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
        {todo.title}
      </span>
      <button onClick={handleDelete}>Delete</button>
    </li>
  );
}

export default TodoItem;