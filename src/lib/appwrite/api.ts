import { ID, Models, Query } from "appwrite"
import {
  appwriteConfig,
  account,
  databases,
  storage,
  avatars,
  functions,
} from "./config"
import {
  IClient,
  IDocument,
  IMember,
  IMilestone,
  INewClient,
  INewMilestone,
  INewOpportunity,
  INewProject,
  IOpportunity,
  IProject,
  IRequest,
  IUpdateDocument,
  IUpdateMember,
  IUpdateStakeholder,
} from "@/types"
import { nanoid } from "nanoid"

export async function signInAccount(member: {
  email: string
  password: string
}) {
  try {
    const session = await account.createEmailSession(
      member.email,
      member.password
    )
    return session
  } catch (error) {
    console.log(error)
  }
}

export async function getCurrentMember() {
  try {
    const session = await account.getSession("current")

    if (!session || !session.userId) throw new Error("No active session.")

    const currentMember = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.memberCollectionId,
      [Query.equal("accountId", session.userId)]
    )

    if (!currentMember || currentMember.documents.length === 0)
      throw new Error("Member not found.")

    if (currentMember.documents[0].role !== "admin") {
      throw new Error("Unauthorized access.")
    }

    const profile = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.profileCollectionId,
      currentMember.documents[0].profileId
    )

    if (!profile) throw new Error("Profile not found.")

    const member = {
      ...currentMember.documents[0],
      profile: {
        ...profile,
      },
    }

    return { member, error: null }
  } catch (error) {
    console.log(error)
    return { member: null, error }
  }
}

export async function getAccount() {
  try {
    const currentAccount = await account.get()
    return currentAccount
  } catch (error) {
    return null
  }
}

export async function signOutAccount() {
  try {
    const session = await account.deleteSession("current")
    return session
  } catch (error) {
    console.log(error)
  }
}

export async function getRequests() {
  const requests = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.requestCollectionId,
    [Query.limit(100), Query.orderDesc("$createdAt")]
  )

  if (!requests) throw Error

  return requests
}

export async function getFeedbackRequests() {
  const feedbackRequests = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.feedbackRequestCollectionId,
    [Query.limit(100), Query.orderDesc("$createdAt")]
  )

  if (!feedbackRequests) throw Error

  return feedbackRequests
}

export async function getStakeholders() {
  const stakeholders = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.stakeholderCollectionId,
    [Query.limit(100), Query.orderDesc("$createdAt")]
  )

  if (!stakeholders) throw Error

  return stakeholders
}

export async function getMembers() {
  const members = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.memberCollectionId,
    [Query.limit(100), Query.orderDesc("$createdAt")]
  )

  if (!members) throw Error

  return members
}

export async function getProfiles() {
  const profiles = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.profileCollectionId,
    [Query.limit(100), Query.orderDesc("$createdAt")]
  )

  if (!profiles) throw Error

  return profiles
}

export async function getMemberById(memberId?: string) {
  if (!memberId) throw Error

  try {
    const member = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.memberCollectionId,
      memberId
    )

    if (!member) throw Error

    return member
  } catch (error) {
    console.log(error)
  }
}

export async function getMemberStatus(memberId?: string) {
  if (!memberId) throw Error

  try {
    const member = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.memberCollectionId,
      memberId
    )

    if (!member) throw Error

    return member.status
  } catch (error) {
    console.log(error)
  }
}

export async function getProfileById(profileId?: string) {
  if (!profileId) throw Error

  try {
    const profile = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.profileCollectionId,
      profileId
    )

    if (!profile) throw Error

    return profile
  } catch (error) {
    console.log(error)
  }
}

export async function updateMember(member: IUpdateMember) {
  const hasFileToUpdate = member.file.length > 0
  try {
    let avatar = {
      avatarUrl: member.avatarUrl,
      avatarId: member.avatarId,
    }

    if (hasFileToUpdate) {
      const uploadedFile = await uploadFile(member.file[0])
      if (!uploadedFile) throw Error

      const fileUrl = getFilePreview(uploadedFile.$id)
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id)
        throw Error
      }

      avatar = { ...avatar, avatarUrl: fileUrl, avatarId: uploadedFile.$id }
    }

    const updatedMember = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.memberCollectionId,
      member.memberId,
      {
        email: member.email,
        importedAnswers: member.importedAnswers,
        emailVerification: member.emailVerification,
        firstName: member.firstName,
        lastName: member.lastName,
        status: member.status,
        contractSigned: member.contractSigned,
        timezone: member.timezone,
        avatarUrl: avatar.avatarUrl,
        avatarId: avatar.avatarId,
      }
    )

    if (!updatedMember) {
      if (hasFileToUpdate) {
        await deleteFile(avatar.avatarId)
      }
      throw Error
    }

    if (member.avatarId && hasFileToUpdate) {
      await deleteFile(member.avatarId)
    }

    return updatedMember
  } catch (error) {
    console.log(error)
  }
}

export async function getClients() {
  const clients = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.clientCollectionId
  )

  if (!clients) throw Error

  return clients
}

export async function createClient(client: INewClient) {
  try {
    let logoUrl
    let uploadedFile

    if (client.file[0]) {
      uploadedFile = await uploadFile(client.file[0])

      if (!uploadedFile) throw Error

      logoUrl = getFilePreview(uploadedFile.$id)
      if (!logoUrl) {
        await deleteFile(uploadedFile.$id)
        throw Error
      }
    } else {
      logoUrl = avatars.getInitials(client.name)
    }

    const newClient = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.clientCollectionId,
      ID.unique(),
      {
        name: client.name,
        logoId: uploadedFile ? uploadedFile.$id : nanoid(),
        logoUrl,
      }
    )

    if (!newClient && uploadedFile) {
      await deleteFile(uploadedFile.$id)
      throw Error
    }

    return newClient
  } catch (error) {
    console.log(error)
  }
}

export async function getClientById(clientId?: string) {
  if (!clientId) throw Error

  try {
    const client = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.clientCollectionId,
      clientId
    )

    if (!client) throw Error

    return client
  } catch (error) {
    console.log(error)
  }
}

export async function uploadFile(file: File) {
  try {
    const uploadedFile = await storage.createFile(
      appwriteConfig.storageId,
      ID.unique(),
      file
    )

    return uploadedFile
  } catch (error) {
    console.log(error)
  }
}

export function getFilePreview(fileId: string) {
  try {
    const fileUrl = storage.getFilePreview(
      appwriteConfig.storageId,
      fileId,
      400,
      400
    )

    if (!fileUrl) throw Error

    return fileUrl
  } catch (error) {
    console.log(error)
  }
}

export async function updateClient(client: IClient) {
  const hasFileToUpdate = client.file.length > 0

  try {
    let logo = {
      logoUrl: client.logoUrl,
      logoId: client.logoId,
    }

    if (hasFileToUpdate) {
      const uploadedFile = await uploadFile(client.file[0])
      if (!uploadedFile) throw Error

      const fileUrl = getFilePreview(uploadedFile.$id)
      if (!fileUrl) {
        await deleteFile(uploadedFile.$id)
        throw Error
      }

      logo = { ...logo, logoUrl: fileUrl, logoId: uploadedFile.$id }
    }

    const updatedClient = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.clientCollectionId,
      client.id,
      {
        name: client.name,
        description: client.description,
        website: client.website,
        x: client.x,
        linkedin: client.linkedin,
        documents: client.documents,
        projects: client.projects,
        logoUrl: logo.logoUrl,
        logoId: logo.logoId,
      }
    )

    if (!updatedClient) {
      if (hasFileToUpdate) {
        await deleteFile(logo.logoId)
      }

      throw Error
    }

    if (hasFileToUpdate) {
      await deleteFile(client.logoId)
    }

    return updatedClient
  } catch (error) {
    console.log(error)
  }
}

export async function assignMemberToClient(
  clientId: string,
  memberArray: IMember[]
) {
  try {
    const updatedClient = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.clientCollectionId,
      clientId,
      {
        members: memberArray,
      }
    )

    if (!updatedClient) throw Error

    return updatedClient
  } catch (error) {
    console.log(error)
  }
}

export async function deleteClient(clientId?: string, logoId?: string) {
  if (!clientId || !logoId) return

  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.clientCollectionId,
      clientId
    )

    if (!statusCode) throw Error

    await deleteFile(logoId)

    return { status: "Ok" }
  } catch (error) {
    console.log(error)
  }
}

export async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile(appwriteConfig.storageId, fileId)
    return { status: "ok" }
  } catch (error) {
    console.log(error)
  }
}

export async function createProject(project: INewProject) {
  try {
    const newProject = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.projectCollectionId,
      ID.unique(),
      {
        clientId: project.clientId,
        title: project.title,
        status: "in progress",
      }
    )

    return newProject
  } catch (error) {
    console.log(error)
  }
}

export async function updateProject(project: IProject) {
  try {
    const updatedProject = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.projectCollectionId,
      project.projectId,
      {
        title: project.title,
        sparkRep: project.sparkRep,
        briefLink: project.briefLink,
        roadmapLink: project.roadmapLink,
        status: project.status,
      }
    )

    if (!updatedProject) {
      throw Error
    }

    return updatedProject
  } catch (error) {
    console.log(error)
  }
}

export async function getProjectById(projectId?: string) {
  if (!projectId) throw Error

  try {
    const project = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.projectCollectionId,
      projectId
    )

    if (!project) throw Error

    return project
  } catch (error) {
    console.log(error)
  }
}

export async function getClientProjects(clientId?: string) {
  if (!clientId) return

  try {
    const projects = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.projectCollectionId,
      [Query.equal("clientId", clientId), Query.orderDesc("$createdAt")]
    )

    if (!projects) throw Error

    return projects
  } catch (error) {
    console.log(error)
  }
}

export async function createOpportunity(opportunity: INewOpportunity) {
  try {
    const newOpportunity = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      ID.unique(),
      {
        clientId: opportunity.clientId,
        projectId: opportunity.projectId,
        memberId: opportunity.memberId,
        status: opportunity.status,
        role: opportunity.role,
        startDate: opportunity.startDate?.toISOString(),
        background: opportunity.background,
        description: opportunity.description,
        duration: opportunity.duration,
        type: opportunity.type,
        estimatedEarnings: opportunity.estimatedEarnings,
        responsibilities: opportunity.responsibilities,
      }
    )

    return newOpportunity
  } catch (error) {
    console.log(error)
  }
}

export async function updateOpportunity(opportunity: IOpportunity) {
  try {
    const updatedOpportunity = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      opportunity.opportunityId,
      {
        status: opportunity.status,
        role: opportunity.role,
        startDate: opportunity.startDate?.toISOString(),
        background: opportunity.background,
        description: opportunity.description,
        duration: opportunity.duration,
        type: opportunity.type,
        estimatedEarnings: opportunity.estimatedEarnings,
        responsibilities: opportunity.responsibilities,
      }
    )

    if (!updatedOpportunity) {
      throw Error
    }

    return updatedOpportunity
  } catch (error) {
    console.log(error)
  }
}

export async function getOpportunityById(opportunityId?: string) {
  if (!opportunityId) throw Error

  try {
    const opportunity = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      opportunityId
    )

    if (!opportunity) throw Error

    return opportunity
  } catch (error) {
    console.log(error)
  }
}

export async function getClientOpportunities(clientId?: string) {
  if (!clientId) return

  try {
    const opportunities = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      [Query.equal("clientId", clientId), Query.orderDesc("$createdAt")]
    )

    if (!opportunities) throw Error

    return opportunities
  } catch (error) {
    console.log(error)
  }
}

export async function deleteOpportunity(
  opportunityId?: string,
  clientId?: string
) {
  if (!opportunityId) return

  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      opportunityId
    )

    if (!statusCode) throw Error

    return clientId
  } catch (error) {
    console.log(error)
  }
}

export async function getProjectMilestones(projectId?: string) {
  if (!projectId) return

  try {
    const milestones = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.milestoneCollectionId,
      [Query.equal("projectId", projectId), Query.orderDesc("$createdAt")]
    )

    if (!milestones) throw Error

    return milestones.documents
  } catch (error) {
    console.log(error)
  }
}

export async function getMilestoneUpdates(milestoneId?: string) {
  if (!milestoneId) return

  try {
    const updates = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.updateCollectionId,
      [Query.equal("milestoneId", milestoneId)]
    )

    if (!updates) throw Error

    return updates.documents
  } catch (error) {
    console.log(error)
  }
}

export async function createMilestone(milestone: INewMilestone) {
  try {
    const newMilestone = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.milestoneCollectionId,
      ID.unique(),
      {
        projectId: milestone.projectId,
        title: milestone.title,
      }
    )

    return newMilestone
  } catch (error) {
    console.log(error)
  }
}

export async function updateMilestone(milestone: IMilestone) {
  try {
    const updatedMilestone = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.milestoneCollectionId,
      milestone.milestoneId,
      {
        title: milestone.title,
        status: milestone.status,
      }
    )

    if (!updatedMilestone) {
      throw Error
    }

    return updatedMilestone
  } catch (error) {
    console.log(error)
  }
}

export async function deleteMilestone(milestoneId?: string) {
  if (!milestoneId) return

  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.milestoneCollectionId,
      milestoneId
    )

    if (!statusCode) throw Error

    return { status: "Ok", milestoneId }
  } catch (error) {
    console.log(error)
  }
}

export async function getProjectTeam(projectId?: string) {
  if (!projectId) throw Error("Invalid project ID or member IDs")

  try {
    const opportunities = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.opportunityCollectionId,
      [Query.equal("projectId", projectId)]
    )

    const acceptedOpportunities = opportunities.documents.filter(
      (opportunity) => opportunity.status === "accepted"
    )

    const teamMembers = await Promise.all(
      acceptedOpportunities.map(async (opportunity) => {
        const memberDetails = await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.memberCollectionId,
          opportunity.memberId
        )

        return {
          id: opportunity.memberId,
          firstName: memberDetails.firstName,
          lastName: memberDetails.lastName,
          avatarUrl: memberDetails.avatarUrl,
          role: opportunity.role || "Team member",
        }
      })
    )

    return teamMembers
  } catch (error) {
    console.error("Failed to fetch project team: ", error)
    throw new Error("Error fetching project team")
  }
}

export async function getRequestStatus(requestId?: string) {
  if (!requestId) throw Error

  try {
    const request = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.requestCollectionId,
      requestId
    )

    if (!request) throw Error

    return request.status
  } catch (error) {
    console.log(error)
  }
}

export async function updateRequest(request: IRequest) {
  try {
    const updatedRequest = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.requestCollectionId,
      request.requestId,
      {
        status: request.status,
      }
    )

    if (!updatedRequest) {
      throw Error
    }

    return updatedRequest
  } catch (error) {
    console.log(error)
  }
}

export async function updateStakeholder(stakeholder: IUpdateStakeholder) {
  try {
    const updatedStakeholder = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.stakeholderCollectionId,
      stakeholder.stakeholderId,
      {
        email: stakeholder.email,
        firstName: stakeholder.firstName,
        lastName: stakeholder.lastName,
        clientId: stakeholder.clientId,
      }
    )

    if (!updatedStakeholder) {
      throw Error
    }

    return updatedStakeholder
  } catch (error) {
    console.log(error)
  }
}

export async function getClientDocuments(clientId?: string) {
  if (!clientId) return

  try {
    const documents = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.documentCollectionId,
      [Query.equal("clientId", clientId), Query.orderDesc("$createdAt")]
    )

    if (!documents) throw Error

    return documents
  } catch (error) {
    console.log(error)
  }
}

export async function createDocument(document: IDocument) {
  try {
    const newDocument = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.documentCollectionId,
      ID.unique(),
      {
        clientId: document.clientId,
        title: document.title,
        link: document.link,
        status: document.status,
        stripeId: document.stripeId,
        eukapayId: document.eukapayId,
        invoice: document.invoice,
      }
    )

    return newDocument
  } catch (error) {
    console.log(error)
  }
}

export async function updateDocument(document: IUpdateDocument) {
  try {
    const updatedDocument = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.documentCollectionId,
      document.documentId,
      {
        status: document.status,
      }
    )

    if (!updatedDocument) {
      throw Error
    }

    return updatedDocument
  } catch (error) {
    console.log(error)
  }
}

export async function deleteDocument(documentId?: string) {
  if (!documentId) return

  try {
    const statusCode = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.documentCollectionId,
      documentId
    )

    if (!statusCode) throw Error

    return { status: "Ok", documentId }
  } catch (error) {
    console.log(error)
  }
}

export async function getUpdateFeedback(updateId?: string) {
  if (!updateId) return

  try {
    const feedback = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.feedbackCollectionId,
      [Query.equal("updateId", updateId)]
    )

    if (!feedback) throw Error

    return feedback.documents
  } catch (error) {
    console.log(error)
  }
}

export async function getEukapayInvoices() {
  try {
    const execution = await functions.createExecution("665efb6900291e00ae75")

    if (
      execution.responseStatusCode >= 200 &&
      execution.responseStatusCode < 300
    ) {
      return JSON.parse(execution.responseBody)
    } else {
      throw new Error(
        `Function execution failed with status ${execution.responseStatusCode}: ${execution.responseBody}`
      )
    }
  } catch (error) {
    console.error("Error fetching invoices from server:", error)
    throw error
  }
}

export async function getEukapayInvoice(code: string) {
  try {
    const execution = await functions.createExecution(
      "665f369b001ce922f8f5",
      code
    )

    if (
      execution.responseStatusCode >= 200 &&
      execution.responseStatusCode < 300
    ) {
      return JSON.parse(execution.responseBody)
    } else {
      throw new Error(
        `Function execution failed with status ${execution.responseStatusCode}: ${execution.responseBody}`
      )
    }
  } catch (error) {
    console.error("Error fetching invoices from server:", error)
    throw error
  }
}

export async function getStripePaymentLinks() {
  try {
    const execution = await functions.createExecution("66682cab0002eb009ad7")

    if (
      execution.responseStatusCode >= 200 &&
      execution.responseStatusCode < 300
    ) {
      return JSON.parse(execution.responseBody)
    } else {
      throw new Error(
        `Function execution failed with status ${execution.responseStatusCode}: ${execution.responseBody}`
      )
    }
  } catch (error) {
    console.error("Error fetching payment links from server:", error)
    throw error
  }
}

export async function getStripePayment(id: string) {
  try {
    const execution = await functions.createExecution(
      "6667045d000c65a2ddcb",
      id
    )

    if (
      execution.responseStatusCode >= 200 &&
      execution.responseStatusCode < 300
    ) {
      return JSON.parse(execution.responseBody)
    } else {
      throw new Error(
        `Function execution failed with status ${execution.responseStatusCode}: ${execution.responseBody}`
      )
    }
  } catch (error) {
    console.error("Error fetching payment from server: ", error)
    throw error
  }
}

const createExecution = async (functionId: string, payload: string) => {
  try {
    const execution = await functions.createExecution(functionId, payload)
    if (
      execution.responseStatusCode >= 200 &&
      execution.responseStatusCode < 300
    ) {
      return JSON.parse(execution.responseBody)
    } else {
      throw new Error(
        `Function execution failed with status ${execution.responseStatusCode}: ${execution.responseBody}`
      )
    }
  } catch (error) {
    console.error(`Error fetching data from function ${functionId}: `, error)
    throw error
  }
}

export const getInvoiceData = async (invoices: Models.Document[]) => {
  const results: any[] = []

  for (const invoice of invoices) {
    const result = {
      id: invoice.$id,
      createdAt: invoice.$createdAt,
      title: invoice.title,
      eukapayInvoice: null,
      stripePayment: null,
    }

    if (invoice.eukapayId) {
      try {
        result.eukapayInvoice = await createExecution(
          "665f369b001ce922f8f5",
          invoice.eukapayId
        )
      } catch (error) {
        console.error(
          `Error processing eukapay invoice ID ${invoice.eukapayId}:`,
          error
        )
      }
    }

    if (invoice.stripeId) {
      try {
        result.stripePayment = await createExecution(
          "6667045d000c65a2ddcb",
          invoice.stripeId
        )
      } catch (error) {
        console.error(
          `Error processing stripe payment ID ${invoice.stripeId}:`,
          error
        )
      }
    }

    results.push(result)
  }

  return results
}
