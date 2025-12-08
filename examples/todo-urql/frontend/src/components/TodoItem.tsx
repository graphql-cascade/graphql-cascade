/**
 * TodoItem Component
 *
 * Displays a single todo with update and delete actions.
 * Demonstrates how Cascade keeps the UI in sync automatically.
 */

import React, { useState } from 'react';
import { useMutation } from 'urql';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoItemProps {
  todo: Todo;
}

const UPDATE_TODO_MUTATION = `
  mutation UpdateTodo($id: ID!, $title: String, $completed: Boolean) {
    updateTodo(id: $id, title: $title, completed: $completed) {
      success
      data {
        id
        title
        completed
      }
    }
  }
`;

const DELETE_TODO_MUTATION = `
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
      success
      data {
        id
      }
    }
  }
`;

const TOGGLE_TODO_MUTATION = `
  mutation ToggleTodo($id: ID!) {
    toggleTodo(id: $id) {
      success
      data {
        id
        title
        completed
      }
    }
  }
`;

const TodoItem: React.FC<TodoItemProps> = ({ todo }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  const [, updateTodo] = useMutation(UPDATE_TODO_MUTATION);
  const [, deleteTodo] = useMutation(DELETE_TODO_MUTATION);
  const [, toggleTodo] = useMutation(TOGGLE_TODO_MUTATION);

  const handleToggle = async () => {
    await toggleTodo({ id: todo.id });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(todo.title);
  };

  const handleSave = async () => {
    if (editTitle.trim() && editTitle !== todo.title) {
      await updateTodo({
        id: todo.id,
        title: editTitle.trim(),
      });
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(todo.title);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this todo?')) {
      await deleteTodo({ id: todo.id });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <div className="todo-content">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={handleToggle}
          className="todo-checkbox"
        />

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="todo-edit-input"
          />
        ) : (
          <span className="todo-title" onDoubleClick={handleEdit}>
            {todo.title}
          </span>
        )}
      </div>

      <div className="todo-actions">
        {!isEditing && (
          <>
            <button
              onClick={handleEdit}
              className="btn-edit"
              title="Edit todo"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="btn-delete"
              title="Delete todo"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TodoItem;