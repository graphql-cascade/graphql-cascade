import PostList from './components/PostList'

function App() {
  return (
    <div className="App">
      <header className="bg-blue-600 text-white p-4">
        <h1 className="text-2xl font-bold">GraphQL Cascade Blog</h1>
        <p className="text-sm">Demonstrating relationship tracking with Relay</p>
      </header>
      <main className="container mx-auto p-4">
        <PostList />
      </main>
    </div>
  )
}

export default App