import React, { useState } from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";

const ModelSelector = ({ selectedModel, setSelectedModel }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const models = [
    { label: "Interpreter Model", value: "model1" },
    { label: "Finn Model", value: "model2" }
  ];

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>
          {models.find((model) => model.value === selectedModel)?.label ||
            "Select Model"}
        </Text>
      </Pressable>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalView}>
          {models.map((model) => (
            <Pressable
              key={model.value}
              style={styles.modalButton}
              onPress={() => {
                setSelectedModel(model.value);
                setModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>{model.label}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginVertical: 10
  },
  button: {
    width: "80%",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ffffff",
    borderRadius: 5,
    backgroundColor: "#000000be"
  },
  buttonText: {
    color: "#ffffff",
    textAlign: "center"
  },
  modalView: {
    margin: 20,
    backgroundColor: "#000000",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalButton: {
    width: "100%",
    padding: 10,
    marginVertical: 5,
    backgroundColor: "#007bff",
    borderRadius: 5
  },
  modalButtonText: {
    color: "#ffffff",
    textAlign: "center"
  }
});

export default ModelSelector;
