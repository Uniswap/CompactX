/* eslint-disable react-refresh/only-export-components */
// Mock message component
export const MessageComponent = () => null;
MessageComponent.success = (content: string) => {
  console.log('Success:', content);
};
MessageComponent.error = (content: string) => {
  console.log('Error:', content);
};
export const message = MessageComponent;
