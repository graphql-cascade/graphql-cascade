import { useQuery, gql } from '@apollo/client';
import TodoList from './components/TodoList';
import AddTodo from './components/AddTodo';

const GET_TODOS = gql`
  query GetTodos {
    todos {
      id
      title
      completed
    }
  }
`;

function App() {
  const { loading, error, data } = useQuery(GET_TODOS);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>Todo App with GraphQL Cascade</h1>
      <AddTodo />
      <TodoList todos={data.todos} />
    </div>
  );
}

export default App;