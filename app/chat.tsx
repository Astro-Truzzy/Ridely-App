import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, Send, User, Phone, Info } from 'lucide-react-native';
import { router } from 'expo-router';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'rider';
  timestamp: Date;
  type?: 'text' | 'system';
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Delivery started! I\'m on my way to pickup location.',
      sender: 'rider',
      timestamp: new Date(Date.now() - 600000),
      type: 'text',
    },
    {
      id: '2',
      text: 'Great! How long will it take?',
      sender: 'user',
      timestamp: new Date(Date.now() - 580000),
      type: 'text',
    },
    {
      id: '3',
      text: 'About 10-15 minutes depending on traffic. I\'ll keep you updated!',
      sender: 'rider',
      timestamp: new Date(Date.now() - 560000),
      type: 'text',
    },
    {
      id: '4',
      text: 'Perfect, thank you!',
      sender: 'user',
      timestamp: new Date(Date.now() - 540000),
      type: 'text',
    },
    {
      id: '5',
      text: 'I\'m approaching your pickup location now. Please have the package ready.',
      sender: 'rider',
      timestamp: new Date(Date.now() - 120000),
      type: 'text',
    },
  ]);
  
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages are added
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        sender: 'user',
        timestamp: new Date(),
        type: 'text',
      };

      setMessages(prev => [...prev, newMessage]);
      setInputText('');

      // Simulate rider response
      setTimeout(() => {
        const riderResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Thanks for the message! I\'ll keep you updated on my progress.',
          sender: 'rider',
          timestamp: new Date(),
          type: 'text',
        };
        setMessages(prev => [...prev, riderResponse]);
      }, 2000);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.riderMessage]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.riderBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.riderText]}>
            {item.text}
          </Text>
        </View>
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.riderTimestamp]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.riderAvatar}>
            <User size={20} color="#FFFFFF" strokeWidth={2} />
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>Mike Johnson</Text>
            <Text style={styles.riderStatus}>Your delivery rider</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.callButton}>
          <Phone size={20} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.infoButton}>
            <Info size={20} color="#6B7280" strokeWidth={2} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, inputText.trim() ? styles.sendButtonActive : null]}
            onPress={sendMessage}
            disabled={!inputText.trim()}>
            <Send
              size={20}
              color={inputText.trim() ? '#FFFFFF' : '#9CA3AF'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#5A47FF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  riderStatus: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  riderMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 4,
  },
  userBubble: {
    backgroundColor: '#5A47FF',
    borderBottomRightRadius: 4,
  },
  riderBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  riderText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
  },
  userTimestamp: {
    color: '#9CA3AF',
    textAlign: 'right',
  },
  riderTimestamp: {
    color: '#6B7280',
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#FFFFFF',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#5A47FF',
  },
});