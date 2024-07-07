import { useState } from 'react';

const Home = () => {
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    const response = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: message })
    });
    const data = await response.json();
    console.log(data);
  };

  return (
    <div>
      <h1>Mini Project</h1>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
};

export default Home;