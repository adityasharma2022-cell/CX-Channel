## WE NEED TO INTRODUCE MULTIPLE UPDATE ADD NEW FEATURES OR IMPOVE SOME FEATURES TO FINALIZE THE MAIN DASHABORAD

# MAIN DASHBOARD (`index.html`) this is html page for the admins to view request based upon table and see the status of the request you can also see other .md files under (`/specs`).

- the update or new features should reflect all over the website and be flexible this should not brake any behaviour or existing features.
- dont chnage anything else other than the modification mentioned in this .md requirement scope.

# 1 New Request --> Total Request Status.

- when customer creates a new request or a support request this futionality is in the customer-portal to create a request you can check that too for context.
  i want the new request to be a part of the Total Request Dashborad card so ( new request --> +1 to total request). current behaviour is that new request is considered an open request.

# 2 RMA generation logic.

- the RMA is generated only when the admin approves the request the RMA should only generate a number (12983). current Behaviour (RMA --> T-21973) so remove the "T-" keyword for generating the RMA.
- also the approval logic is not correct. current behaviour (admin clicks on approve request rma is generated the the ui is updated to show customer is mailed even of the customer is failed to be mailed) so fix that when customer is failed to mail by the SendMail() the status should say Failed to Mail the customer.
- when the RMA is generate this should be considered as an OPEN status request so RMA generated +1 to the OPEN status.

# 3 Dashboard Cards.

- current 5 dashboard card TOTAL REQUEST , OPEN , PENDING , PENDING FROM CUSOTMER, PENDING FROM FASTECH,CLOSED it shoulbe the rest and add one more status OPEN FROM OEM.
- this STatus PENDIGN FROM OEM should come from the VIEW request panel where the admin can select the status by themself we have alreadt 2 status dropdown in the view panel so it should be one status for OPEN CLOSE PENDING APPROVED and other status for PENDIGN FROM CUSTOMER , PENDING FROM FASTECH and PENDIGN FROM OEM it funtionality should reflect all over the DASHBOARD,
# 4. View Button.

- add another status besides the two status dropdown so this new status should be an input so admin can type this status we should not display this status in the table rather in the export CSV file.
- Also the APPROVE REQUEST AND REJECT REQUEST should be APPROVE REQUEST AND DISAPPROVE REQUEST and when the request is disapproved by the Admin, admin can type why the request is disapproved and this inout should be mailed to the customer FOR THE DISAPPROVED mail state. structure (DISAPPROVE REQUEST a panel or dialog box open in the center so the admin can confirm to disapprove and add the input or reason for disapproving the request).
- the input dropdown Waranty should be YES,NO,AMC not out of waranty.

# 5 Export to CSV.

    - Export to CSV is something that lets the admin download all the table data to into a table manner we already have the implmentation we just have to add more fields to this.
    - when we CLICK on the View button all the Details like every single one of them should be Seen in the export to csv column and there details in the rows specific to the request.

# 6 data search.

    - above the RMA request table there is the seacrh or filter data fields in the keyword input change it to RMA so throuh this input the RMA to that Request can be searched right now only keywords or realated data can be searched but no the specific RMA request.
    - Remove the TEAM( FORWADED TO) field no need of it.

# 7 Table (RMA REQUEST).

- RMA REQUEST TABLE should also add a column RMA ISSUED DATE (BASICALLY RMA GENERATED DATE) so the admins know the RMA ISSUED DATE this should be flexible to all other behaviour and also should be shown in the export to csv documnet.
