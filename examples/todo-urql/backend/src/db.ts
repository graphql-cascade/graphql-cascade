export interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

let todos: Todo[] = [
  { id: '1', title: 'Learn GraphQL Cascade', completed: false },
  { id: '2', title: 'Build todo app', completed: false },
];

let nextId = 3;

export const getTodos = (): Todo[] => todos;

export const getTodo = (id: string): Todo | undefined => todos.find(t => t.id === id);

export const createTodo = (title: string): Todo => {
  const todo: Todo = { id: nextId.toString(), title, completed: false };
  todos.push(todo);
  nextId++;
  return todo;
};

export const updateTodo = (id: string, updates: Partial<Pick<Todo, 'title' | 'completed'>>): Todo | null => {
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  Object.assign(todo, updates);
  return todo;
};

export const deleteTodo = (id: string): boolean => {
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) return false;
  todos.splice(index, 1);
  return true;
};

export const toggleTodo = (id: string): Todo | null => {
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  todo.completed = !todo.completed;
  return todo;
};