<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <workflowAlerts>
        <fullName>emailalert1</fullName>
        <description>emailalert1</description>
        <protected>false</protected>
        <recipients>
            <recipient>user_tmp@salesforce.com</recipient>
            <type>user</type>
        </recipients>
        <senderType>CurrentUser</senderType>
        <template>emailtest/MarketingProductInquiryResponse</template>
    </workflowAlerts>
    <workflowFieldUpdates>
        <fullName>fieldupdate1</fullName>
        <description>this is fieldupdate 1</description>
        <field>BillingCountry</field>
        <formula>&quot;USA&quot;</formula>
        <name>fieldupdate1</name>
        <notifyAssignee>false</notifyAssignee>
        <operation>Formula</operation>
        <protected>false</protected>
    </workflowFieldUpdates>
    <workflowOutboundMessages>
        <fullName>outboundmsg1</fullName>
        <apiVersion>46.0</apiVersion>
        <description>this is outbound message 1</description>
        <endpointUrl>https://mobile1.t.salesforce.com/</endpointUrl>
        <fields>AccountNumber</fields>
        <fields>AccountSource</fields>
        <fields>BillingCity</fields>
        <fields>Id</fields>
        <includeSessionId>false</includeSessionId>
        <integrationUser>user_tmp@salesforce.com</integrationUser>
        <name>outboundmsg1</name>
        <protected>false</protected>
        <useDeadLetterQueue>false</useDeadLetterQueue>
    </workflowOutboundMessages>
    <workflowTasks>
        <fullName>task_1</fullName>
        <assignedTo>user_tmp@salesforce.com</assignedTo>
        <assignedToType>user</assignedToType>
        <description>This is task 1.</description>
        <dueDateOffset>1</dueDateOffset>
        <notifyAssignee>false</notifyAssignee>
        <priority>High</priority>
        <protected>false</protected>
        <status>Not Started</status>
        <subject>task 1</subject>
    </workflowTasks>
</Workflow>
