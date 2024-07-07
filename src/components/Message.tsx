import React from 'react';

type MessageProps = {
  content: string;
};

const Message: React.FC<MessageProps> = ({ content }) => {
  return <div>{content}</div>;
};

export default Message;