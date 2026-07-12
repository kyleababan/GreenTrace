import AssessmentList from "../components/AssessmentList";

export default function CriticalSituation(props) {

    return (

        <AssessmentList
            status="Critical"
            color="#FF6666"
            {...props}
        />

    );

}