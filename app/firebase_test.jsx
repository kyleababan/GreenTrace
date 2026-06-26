import { View, Text, TouchableOpacity } from "react-native";

import { collection, addDoc } from "firebase/firestore";

import { db } from "../firebaseConfig";

export default function FirebaseTest() {

  const testFirebase = async () => {

    try {

      await addDoc(

        collection(db,"test"),

        {

          message:"Firebase Connected",

          createdAt: new Date()

        }

      );

      alert("Success");

    }

    catch(error){

      console.log(error);

      alert(error.message);

    }

  };

  return (

    <View
      style={{
        flex:1,
        justifyContent:'center',
        alignItems:'center'
      }}
    >

      <TouchableOpacity
        style={{
          backgroundColor:'green',
          padding:20
        }}
        onPress={testFirebase}
      >

        <Text
          style={{
            color:'white'
          }}
        >

          Test Firebase

        </Text>

      </TouchableOpacity>

    </View>

  );

}