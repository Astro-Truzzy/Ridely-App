import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { captureException } from '@/lib/sentry';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
  resetKey: number;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, {
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      message: '',
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. You can try again, or restart the
            app if this keeps happening.
          </Text>
          {__DEV__ && this.state.message ? (
            <Text style={styles.detail}>{this.state.message}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0B1220',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#94A3B8',
    marginBottom: 16,
  },
  detail: {
    fontSize: 12,
    color: '#F87171',
    marginBottom: 16,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#174AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
