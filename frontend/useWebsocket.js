// useWebSocket.js
import { useState, useEffect, useCallback } from "react";

export const useWebSocket = (SEND_URL, RECEIVE_URL) => {
  const [sendConnection, setSendConnection] = useState(null);
  const [receiveConnection, setReceiveConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const connectWebSockets = useCallback(() => {
    console.log("Attempting to connect WebSocket servers...");

    const sendSocket = new WebSocket(SEND_URL);
    const receiveSocket = new WebSocket(RECEIVE_URL);

    sendSocket.onopen = () => {
      console.log("Send WebSocket connected");
      setIsConnected(true);
    };

    sendSocket.onclose = () => {
      console.log("Send WebSocket closed");
      setIsConnected(false);
    };

    sendSocket.onerror = (error) => {
      console.error("Send WebSocket error:", error.message);
      setIsConnected(false);
    };

    sendSocket.onmessage = (event) => {
      console.log("Send WebSocket received message:", event.data);
    };

    receiveSocket.onopen = () => {
      console.log("Receive WebSocket connected");
      setIsConnected(true);
    };

    receiveSocket.onclose = () => {
      console.log("Receive WebSocket closed");
      setIsConnected(false);
    };

    receiveSocket.onerror = (error) => {
      console.error("Receive WebSocket error:", error.message);
      setIsConnected(false);
    };

    receiveSocket.onmessage = (event) => {
      console.log("Receive WebSocket received message:", event.data);
    };

    setSendConnection(sendSocket);
    setReceiveConnection(receiveSocket);
  }, [SEND_URL, RECEIVE_URL]);

  useEffect(() => {
    connectWebSockets();
    return () => {
      if (sendConnection) {
        console.log("Closing send WebSocket");
        sendConnection.close();
      }
      if (receiveConnection) {
        console.log("Closing receive WebSocket");
        receiveConnection.close();
      }
    };
  }, [connectWebSockets]);

  return {
    sendConnection,
    receiveConnection,
    isConnected,
    reconnect: connectWebSockets
  };
};
