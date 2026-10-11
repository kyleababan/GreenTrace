import AssessmentList from "../components/AssessmentList";

export default function ModerateSituation(props) {
    return (
        <AssessmentList
            status="Moderate"
            color="#ff8c40"
            {...props}
        />
    );
}