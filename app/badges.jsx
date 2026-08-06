import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Navbar from "../components/navbar";
import { BADGES, getUserContributionStats, isBadgeEarned } from "../constants/badges";
import { auth, db } from "../firebaseConfig";

export default function BadgesScreen() {
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const loadBadges = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const [posts, volunteerPosts] = await Promise.all([
        getDocs(collection(db, "posts")),
        getDocs(collection(db, "volunteer_posts")),
      ]);
      setStats(getUserContributionStats(user.uid, posts.docs.map((item) => item.data()), volunteerPosts.docs.map((item) => item.data())));
    };
    loadBadges().catch((error) => console.log("Unable to load badges:", error));
  }, []);

  const badges = useMemo(() => BADGES.map((badge) => ({ ...badge, earned: stats && isBadgeEarned(badge, stats) })), [stats]);

  return <SafeAreaView style={styles.wrapper}><View style={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Image source={require("../assets/images/back.png")} style={styles.backIcon}/></TouchableOpacity><Image source={require("../assets/images/rank.png")} style={styles.headerIcon}/><View><Text style={styles.title}>Badge List</Text><Text style={styles.subtitle}>Collect badges through community action</Text></View></View>
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      {!stats ? <View style={styles.loading}><ActivityIndicator color="#5F9C76" /></View> : badges.map((badge) => <View key={badge.id} style={[styles.card, !badge.earned && styles.lockedCard]}><Text style={[styles.badgeIcon, !badge.earned && styles.locked]}>{badge.icon}</Text><View style={styles.details}><Text style={[styles.badgeTitle, !badge.earned && styles.lockedText]}>{badge.title}</Text><Text style={styles.description}>{badge.description}</Text><Text style={styles.requirement}>{badge.earned ? "Obtained" : `${badge.type === "reports" ? stats.cleanedReports : stats.volunteeredCount}/${badge.required} completed`}</Text></View></View>)}
    </ScrollView>
    <View style={styles.nav}><Navbar /></View>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({ wrapper:{flex:1,backgroundColor:"#F4F6F8",alignItems:"center"},container:{flex:1,width:"100%",maxWidth:500},header:{flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#5F9C76",padding:20},backIcon:{width:32,height:32,tintColor:"#fff"},headerIcon:{width:38,height:38,tintColor:"#fff"},title:{color:"#fff",fontSize:22,fontWeight:"700"},subtitle:{color:"#E8F3EC",fontSize:12,marginTop:2},list:{flex:1},listContent:{padding:16,paddingBottom:24},card:{flexDirection:"row",backgroundColor:"#fff",borderRadius:16,padding:15,marginBottom:12,elevation:2,shadowColor:"#000",shadowOpacity:.08,shadowRadius:4},lockedCard:{backgroundColor:"#F8FAF9"},badgeIcon:{fontSize:30,marginRight:14,alignSelf:"center"},locked:{opacity:.3},details:{flex:1},badgeTitle:{fontSize:16,fontWeight:"700",color:"#334155"},lockedText:{color:"#94A3B8"},description:{fontSize:13,color:"#64748B",lineHeight:18,marginTop:3},requirement:{fontSize:12,fontWeight:"700",color:"#5F9C76",marginTop:7},loading:{paddingTop:48,alignItems:"center"},nav:{borderTopWidth:1,borderColor:"#E5E7EB",backgroundColor:"#fff"} });
