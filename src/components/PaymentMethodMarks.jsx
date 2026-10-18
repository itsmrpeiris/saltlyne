import IconMarks from "./IconMarks";

export default function PaymentMethodMarks({ className = "footer-payment-icons", icons }) {
    return <IconMarks className={className} kind="payment" icons={icons}/>;
}
